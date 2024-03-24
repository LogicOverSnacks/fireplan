import { animate, style, transition, trigger } from '@angular/animations';
import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { Store } from '@ngxs/store';
import cdf from '@stdlib/stats-base-dists-normal-cdf';
import quantile from '@stdlib/stats-base-dists-normal-quantile';
import moment, { Moment } from 'moment';
import { Subject, Subscription, animationFrameScheduler, combineLatest, finalize, fromEvent, map, takeUntil, throttleTime } from 'rxjs';

import { CoreModule } from '~/core';
import { AssetsState } from '~/state/clients/assets.state';
import { PeopleState } from '~/state/clients/people.state';
import { PatchStage, StagesState } from '~/state/clients/plans/stages.state';
import { GraphsState } from '~/state/graphs.state';
import { GraphDelta, calculateCycles } from './cycle-calculation';
import type { CycleData } from './cycle.worker'
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    MatCheckboxModule,
    MatDividerModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSliderModule,

    CoreModule
  ],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class OverviewComponent {
  store = inject(Store);

  stagesElement = viewChild.required<ElementRef<HTMLElement>>('stages');
  svg = viewChild.required<ElementRef<SVGElement>>('svg');
  percentileControl = new FormControl(90, { nonNullable: true });
  percentile = toSignal(
    this.percentileControl.valueChanges.pipe(
      throttleTime(50, animationFrameScheduler, { leading: true, trailing: true }),
      map(value => (100 - value) / 2)
    ),
    { initialValue: (100 - this.percentileControl.value) / 2 }
  );
  logarithmicViewCtrl = new FormControl(false, { nonNullable: true });
  logarithmicView = toSignal(this.logarithmicViewCtrl.valueChanges, { initialValue: this.logarithmicViewCtrl.value });
  displayMedianCtrl = new FormControl(true, { nonNullable: true });
  displayHoverCtrl = new FormControl(true, { nonNullable: true });

  hoverPoint = signal<{
    mouse: { x: number; y: number; };
    lower: { x: number; y: number; textY: number; value: number; };
    median: { x: number; y: number; textY: number; value: number; };
    upper: { x: number; y: number; textY: number; value: number; };
  } | null>(null);
  now = computed(() => moment());
  maxYear = toSignal(this.store.select(PeopleState.maxYear(3)), { requireSync: true });
  graphResolution = signal(37);

  yearsPerCycle = computed(() => this.maxYear() - this.now().year());
  monthsPerCycle = computed(() => this.yearsPerCycle() * 12);

  people = toSignal(this.store.select(PeopleState.people), { requireSync: true });
  deltas = toSignal(
    combineLatest([
      this.store.select(GraphsState.inflation),
      this.store.select(GraphsState.cash),
      this.store.select(GraphsState.bonds),
      this.store.select(GraphsState.stocks),
      this.store.select(GraphsState.crypto)
    ]).pipe(map(([[, inflation], [, cash], [, bonds], [, stocks], [, crypto]]) => {
      const maxDate = [inflation, cash, bonds, stocks, crypto]
        .map(graph => moment(graph.data[graph.data.length - 1].date))
        .reduce((a, b) => a.isBefore(b) ? a : b);

      [inflation, cash, bonds, stocks, crypto] = [inflation, cash, bonds, stocks, crypto].map(graph => ({
        data: graph.data.filter(({ date }) => moment(date).isSameOrBefore(maxDate, 'month'))
      }));

      const monthsAvailable = Math.min(...[inflation, cash, bonds, stocks, crypto].map(graph => graph.data.length));

      if (this.monthsPerCycle() > monthsAvailable)
        throw new Error(`Graphs do not provide enough data`);

      [inflation, cash, bonds, stocks, crypto] = [inflation, cash, bonds, stocks, crypto].map(graph => ({
        data: graph.data.slice(-monthsAvailable)
      }));

      const deltas: GraphDelta[] = [];
      for (let i = 0; i < monthsAvailable; ++i) {
        deltas.push({
          inflation: inflation.data[i].value,
          cash: cash.data[i].value,
          bonds: bonds.data[i].value,
          stocks: stocks.data[i].value,
          crypto: crypto.data[i].value,
        });
      }

      return deltas;
    })),
    { requireSync: true }
  );
  stages = toSignal(this.store.select(StagesState.unrolledStages), { requireSync: true });
  stageLabels = computed(() => {
    const stages = this.stages();
    const visibleYears = this.xVisibleYears();
    const thisYear = this.now().year();
    const maxYear = thisYear + visibleYears;
    return stages.map((stage, index) => {
      const previousEndYear = index === 0 ? thisYear : (stages[index - 1].endYear ?? maxYear);

      return {
        id: stage.id,
        name: stage.name,
        endYear: stage.endYear,
        width: `${100 * ((stage.endYear ?? maxYear) - previousEndYear) / visibleYears}%`
      };
    });
  });
  // toSignal(store.select(AssetsState.portfolioTotals), { requireSync: true })
  initialPortfolio = signal({
    cash: 0,
    bonds: 0,
    stocks: 360000,
    crypto: 0
  });
  initialTotal = computed(() => Object.values(this.initialPortfolio()).reduce((total, value) => total + value, 0));

  xVisibleYears = computed(() => {
    const percentile = this.percentile();
    const maxVisibleYear = percentile > 0
      ? Math.ceil(Math.max(
        ...this.people().map(({ dateOfBirth, lifeExpectancy }) => quantile(
          1 - percentile / 100,
          dateOfBirth.year() + lifeExpectancy.mean,
          lifeExpectancy.variance
        ))
      ))
      : this.maxYear();
    return maxVisibleYear - this.now().year();
  });
  xUnit = computed(() => 300 / (this.xVisibleYears() * 12));
  xInterval = computed(() => Math.floor(this.xVisibleYears() / (this.xCount - 1)));
  xLabels = computed(() => {
    const start = this.now();
    const xUnit = this.xUnit() * this.xInterval() * 12;
    const getYears = (dateOfBirth: Moment) => {
      const age = Math.floor(start.diff(dateOfBirth, 'years'));
      const allAges = [...Array(this.xVisibleYears())].map((_, index) => `${age + index}`);
      const visibleAges = allAges.filter((_, index) => index % this.xInterval() == 0);

      return visibleAges.map((age, index) => ({ value: age, x: index * xUnit }));
    };

    return this.people().map(person => ({
      id: person.id,
      name: person.name,
      labels: getYears(person.dateOfBirth)
    }));
  });
  xHoverPoint = computed(() => {
    const hoverPoint = this.hoverPoint();
    // if (!hoverPoint) return null;

    const computeLabel =
      hoverPoint ? (startYear: number) => ({
        x: hoverPoint.median.x,
        label: startYear + Math.floor(hoverPoint.median.x / (this.xUnit() * 12))
      })
      : this.xStageHoverYear() ? (startYear: number) => {
        const years = this.xStageHoverYear()! - this.now().year();

        return {
          x: 300 * years / this.xVisibleYears(),
          label: startYear + years
        };
      }
      : null;

    if (!computeLabel) return null;

    // const x = hoverPoint.median.x;
    // const xUnit = this.xUnit() * 12;

    return Object.fromEntries(this.people().map(person => [
      person.id,
      computeLabel(Math.floor(this.now().diff(person.dateOfBirth, 'years')))
      // {
      //   x: x,
      //   label: `${Math.floor(this.now().diff(person.dateOfBirth, 'years')) + Math.floor(x / xUnit)}`
      // }
    ]));
  });
  xStageHoverYear = signal<number | null>(null);
  xLabelWidth = computed(() => {
    const xRemainder = this.xVisibleYears() - this.xInterval() * (this.xCount - 1);
    const labelledXPortion = (this.xVisibleYears() - xRemainder) / this.xVisibleYears();
    return `${100 * labelledXPortion / (this.xCount - 1)}%`;
  });
  yMinVisibleValue = computed(() => this.logarithmicView()
    ? Math.max(Math.min(...this.points().boundaries[0]), this.initialTotal() / 4)
    : 0
  );
  yMaxVisibleValue = computed(() => this.logarithmicView()
    ? Math.max(...this.points().boundaries[this.points().boundaries.length - 1], 0)
    : Math.min(
      Math.max(...this.points().boundaries[this.points().boundaries.length - 1], 0),
      Math.max(...this.points().median, 0) * 1.5,
      this.initialTotal() * 20
    )
  );
  yUnit = computed(() => 100 / (this.logarithmicView()
    ? Math.log(this.yMaxVisibleValue()) - Math.log(this.yMinVisibleValue())
    : this.yMaxVisibleValue()
  ));
  yInterval = computed(() =>
    this.yMaxVisibleValue() > 5000000000 ? 1000000000
    : this.yMaxVisibleValue() > 2500000000 ? 500000000
    : this.yMaxVisibleValue() > 1000000000 ? 250000000
    : this.yMaxVisibleValue() > 500000000 ? 100000000
    : this.yMaxVisibleValue() > 250000000 ? 50000000
    : this.yMaxVisibleValue() > 100000000 ? 25000000
    : this.yMaxVisibleValue() > 50000000 ? 10000000
    : this.yMaxVisibleValue() > 25000000 ? 5000000
    : this.yMaxVisibleValue() > 10000000 ? 2500000
    : this.yMaxVisibleValue() > 5000000 ? 1000000
    : this.yMaxVisibleValue() > 2500000 ? 500000
    : this.yMaxVisibleValue() > 1000000 ? 250000
    : this.yMaxVisibleValue() > 500000 ? 100000
    : this.yMaxVisibleValue() > 250000 ? 50000
    : this.yMaxVisibleValue() > 100000 ? 25000
    : this.yMaxVisibleValue() > 50000 ? 10000
    : this.yMaxVisibleValue() > 25000 ? 5000
    : this.yMaxVisibleValue() > 10000 ? 2500
    : this.yMaxVisibleValue() > 5000 ? 1000
    : this.yMaxVisibleValue() > 2500 ? 500
    : this.yMaxVisibleValue() > 1000 ? 250
    : this.yMaxVisibleValue() > 500 ? 100
    : this.yMaxVisibleValue() > 250 ? 50
    : this.yMaxVisibleValue() > 100 ? 25
    : this.yMaxVisibleValue() > 50 ? 10
    : this.yMaxVisibleValue() > 25 ? 5
    : 1
  );
  yLabels = computed(() => {
    if (this.logarithmicView()) {
      const min = Math.ceil(Math.log10(this.yMinVisibleValue()));
      const max = Math.floor(Math.log10(this.yMaxVisibleValue()));
      const yCount = 1 + max - min;
      return [...Array(yCount)].map((_, index) => ({
        value: Math.pow(10, min + index),
        y: this.getYCoord(Math.pow(10, min + index))
      }));
    }

    const max = this.yMaxVisibleValue();
    const maxExp = Math.floor(Math.log10(max));
    const maxMultiplier = max / Math.pow(10, maxExp);
    const min = this.yMinVisibleValue();
    const minExp = Math.ceil(Math.log10(min));
    const minMultiplier = min / Math.pow(10, minExp);


    // TODO: simplify yInterval by calculating the values
    max - min;



    const yCount = Math.floor(this.yMaxVisibleValue() / this.yInterval());
    return [...Array(yCount)].map((_, index) => ({
      value: (index + 1) * this.yInterval(),
      y: this.getYCoord((index + 1) * this.yInterval())
    }));
  });
  yHoverPoint = computed(() => {
    const hoverPoint = this.hoverPoint();
    if (!hoverPoint) return null;

    return {
      value: this.getYValue(hoverPoint.mouse.y),
      y: hoverPoint.mouse.y
    };
  });

  cycles = signal<number[][]>([]);

  successRate = computed(() => {
    const cycles = this.cycles();
    if (cycles.length <= 0) return 0;

    const people = this.people();
    const thisYear = this.now().year();

    /** The probability for each cycle that all people have died before running out of money */
    const probabilities = cycles
      .map(cycle => cycle.findIndex(value => value <= 0))
      .map(index => index < 0
        ? 1
        : people
          .map(({ dateOfBirth, lifeExpectancy }) => cdf(
            thisYear + index / 12,
            dateOfBirth.year() + lifeExpectancy.mean,
            lifeExpectancy.variance
          ))
          .reduce((a, b) => a * b, 1)
      );

    return probabilities.reduce((a, b) => a + b, 0) / probabilities.length;

  });

  points = computed(() => {
    const cycles = this.cycles();

    const boundaries: number[][] = [...new Array(this.graphResolution())].map(() => []);
    const median: number[] = [];
    const maxIndex = cycles.length - 1;
    const minHeight = maxIndex * this.percentile() / 100;
    const segmentHeight = maxIndex * (1 - 2 * this.percentile() / 100) / (boundaries.length - 1);

    if (cycles.length > 0) {
      for (let m = 0; m < this.xVisibleYears() * 12; ++m) {
        const values = cycles.map(cycle => cycle[m]).sort((a, b) => a - b);
        median.push(values[Math.floor(maxIndex * 0.5)]);

        for (let i = 0; i < boundaries.length; ++i) {
          boundaries[i].push(values[Math.floor(minHeight + i * segmentHeight)]);
        }
      }
    }

    return { boundaries, median };
  });

  paths = computed(() => {
    const { boundaries, median } = this.points();

    const minOpacity = 0.1;
    const maxOpacity = 1;
    const segmentsCount = boundaries.length - 1;
    const opacityDelta = (maxOpacity - minOpacity) / (segmentsCount / 2 - 1);

    return {
      segmentOpacities: [...new Array(segmentsCount)].map((_, index) => index >= segmentsCount / 2
        ? maxOpacity - (index - segmentsCount / 2) * opacityDelta
        : minOpacity + index * opacityDelta
      ),
      segments: boundaries.slice(0, -1).map((_, index) => [
        `M ${this.getXCoord(0)} ${this.getYCoord(this.initialTotal())}`,
        ...boundaries[index].map((value, index) => `L ${this.getXCoord(index)} ${this.getYCoord(value)}`),
        ...boundaries[index+1].map((value, index) => `L ${this.getXCoord(index)} ${this.getYCoord(value)}`).reverse(),
        'Z'
      ].join(' ')),
      median: [
        `M ${this.getXCoord(0)} ${this.getYCoord(this.initialTotal())}`,
        ...median.map((value, index) => `L ${this.getXCoord(index)} ${this.getYCoord(value)}`)
      ].join(' ')
    };
  });

  hoverPath = computed(() => {
    const cycles = this.cycles();
    const point = this.hoverPoint()?.mouse;
    if (!point || cycles.length <= 0) return null;

    const xMaxIndex = this.xVisibleYears() * 12 - 1;
    const xIndex = Math.round((xMaxIndex * point.x) / 300);
    const yValue = this.getYValue(point.y);

    // remove any cycles that already reached 0 before this x position
    const aliveCycles = xIndex > 0 ? cycles.filter(cycle => cycle[xIndex - 1] > 0) : [...cycles];
    // find the cycle with the closest y value to the mouse (at this x position)
    const closestCycle = aliveCycles.sort((a, b) => Math.abs(yValue - a[xIndex]) - Math.abs(yValue - b[xIndex]))[0];
    // don't display anything if that closest y value is too far from the mouse
    if (!closestCycle || Math.abs(this.getYCoord(closestCycle[xIndex]) - point.y) > 2) return null;

    return [
      `M ${this.getXCoord(0)} ${this.getYCoord(this.initialTotal())}`,
      ...closestCycle.map((value, index) => `L ${this.getXCoord(index)} ${this.getYCoord(value)}`)
    ].join(' ');
  });

  getXCoord = (value: number): number => value * this.xUnit();
  getYCoord = (value: number): number => this.logarithmicView()
    ? 100 - (
      Math.max(0, Math.log(value) - Math.log(this.yMinVisibleValue()))
    ) * this.yUnit()
    : 100 - value * this.yUnit();
  getYValue = (y: number): number => this.logarithmicView()
    ? Math.exp((100 - y) / this.yUnit()) * this.yMinVisibleValue()
    : (100 - y) / this.yUnit();

  sliderDisplay = (value: number) => `${value}%`;

  mouseMoved = new Subject<MouseEvent | null>();

  constructor() {
    const canUseWorkers = typeof Worker !== 'undefined';
    let cycleWorker: Worker | undefined;
    let cycleWorkerListener: ((ev: MessageEvent) => void) | undefined;

    const cycleData$ = new Subject<CycleData>();

    cycleData$
      .pipe(
        throttleTime(500, animationFrameScheduler, { leading: true, trailing: true }),
        takeUntilDestroyed()
      )
      .subscribe(data => {
        if (canUseWorkers) {
          if (cycleWorkerListener)
            cycleWorker?.removeEventListener('message', cycleWorkerListener);

          cycleWorker?.terminate();

          cycleWorker = new Worker(new URL('./cycle.worker', import.meta.url));
          cycleWorkerListener = event => this.cycles.set(event.data);
          cycleWorker.onmessage = cycleWorkerListener;
          cycleWorker.postMessage(data);
        } else {
          this.cycles.set(calculateCycles(...data));
        }
      })

    effect(() => {
      const data: CycleData = [
        this.monthsPerCycle(),
        this.now().year(),
        this.maxYear(),
        this.initialPortfolio(),
        this.stages(),
        this.deltas()
      ];

      cycleData$.next(data);
    }, { allowSignalWrites: true });

    this.mouseMoved
      .pipe(
        throttleTime(20, animationFrameScheduler, { leading: true, trailing: true }),
        takeUntilDestroyed()
      )
      .subscribe(event => {
        if (!event) {
          this.hoverPoint.set(null);
          return;
        }

        const pt = new DOMPointReadOnly(event.clientX, event.clientY).matrixTransform(
          (this.svg().nativeElement as any).getScreenCTM().inverse()
        );
        const ptX = pt.x < 0 ? 0
          : pt.x > 300 ? 300
          : pt.x;
        const ptY = pt.y < 0 ? 0
          : pt.y > 100 ? 100
          : pt.y;

        const points = this.points();
        const index = Math.round((points.median.length - 1) * ptX / 300);
        const x = this.getXCoord(index);
        const lowerY = this.getYCoord(points.boundaries[0][index]);
        const medianY = this.getYCoord(points.median[index]);
        const upperY = this.getYCoord(points.boundaries[points.boundaries.length - 1][index]);
        this.hoverPoint.set({
          mouse: { x: ptX, y: ptY },
          lower: {
            x: x,
            y: lowerY <= 0 ? 0
              : lowerY >= 100 ? 100
              : lowerY,
            textY: lowerY <= 12 ? 12
              : (lowerY >= 98 || medianY >= 93 || upperY >= 88) ? 98
              : medianY + 5 >= lowerY ? medianY + 5
              : lowerY,
            value: points.boundaries[0][index]
          },
          median: {
            x: x,
            y: medianY <= 0 ? 0
              : medianY >= 100 ? 100
              : medianY,
            textY: (medianY <= 7 || lowerY <= 12) ? 7
              : (medianY >= 93 || upperY >= 88) ? 93
              : medianY,
            value: points.median[index]
          },
          upper: {
            x: x,
            y: upperY <= 0 ? 0
              : upperY >= 100 ? 100
              : upperY,
            textY: (upperY <= 2 || medianY <= 7 || lowerY <= 12) ? 2
              : upperY >= 88 ? 88
              : medianY - 5 <= upperY ? medianY - 5
              : upperY,
            value: points.boundaries[points.boundaries.length - 1][index]
          }
        });
      });
  }

  stageDragged(stageId: string, event: MouseEvent) {
    event.preventDefault();

    const stage = this.store.selectSnapshot(StagesState.stages).find(({ id }) => id === stageId);
    if (!stage || stage.endYear === undefined) return;

    const startX = event.pageX;
    const xPerYear = this.stagesElement().nativeElement.clientWidth / this.xVisibleYears();
    const originalEndYear = stage.endYear;

    fromEvent<MouseEvent>(this.document, 'mousemove')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        takeUntil(fromEvent(this.document, 'mouseup')),
        throttleTime(50, animationFrameScheduler, { leading: false, trailing: true }),
        finalize(() => {
          this.xStageHoverYear.set(null);
        })
      )
      .subscribe(({ pageX }) => {
        const endYear = Math.round(originalEndYear + (pageX - startX) / xPerYear);
        this.xStageHoverYear.set(endYear);
        this.store.dispatch(new PatchStage(stageId, { endYear }));
      });
  }

  private readonly xCount = 13;
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
}
