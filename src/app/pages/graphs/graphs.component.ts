import { Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';

import { CoreModule } from '~/core';
import {
  AddOrUpdateGraph,
  DeleteGraph,
  Graph,
  GraphsState,
  RenameGraph,
  SetBondsGraph,
  SetCashGraph,
  SetCryptoGraph,
  SetInflationGraph,
  SetStocksGraph
} from '~/state/graphs.state';
import { AddOrEditGraphDialogComponent, AddOrEditGraphDialogData } from './add-or-edit-graph-dialog.component';
import { AppGraphDisplayPipe } from './graph-display.pipe';
import { GraphPreviewComponent } from './graph-preview.component';

@Component({
  selector: 'app-graphs',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatSelectModule,

    CoreModule,
    GraphPreviewComponent
    //AppGraphDisplayPipe
  ],
  templateUrl: './graphs.component.html',
  styleUrl: './graphs.component.scss'
})
export class GraphsComponent {
  @Select(GraphsState.graphs)
  graphs!: Observable<Record<string, Graph>>;

  form = new FormGroup({
    inflation: new FormControl<string | null>(null, Validators.required),
    cash: new FormControl<string | null>(null, Validators.required),
    bonds: new FormControl<string | null>(null, Validators.required),
    stocks: new FormControl<string | null>(null, Validators.required),
    crypto: new FormControl<string | null>(null, Validators.required)
  });

  constructor(
    private dialog: MatDialog,
    private store: Store
  ) {
    const [inflation] = store.selectSnapshot(GraphsState.inflation);
    const [cash] = store.selectSnapshot(GraphsState.cash);
    const [bonds] = store.selectSnapshot(GraphsState.bonds);
    const [stocks] = store.selectSnapshot(GraphsState.stocks);
    const [crypto] = store.selectSnapshot(GraphsState.crypto);

    this.form.setValue({
      inflation,
      cash,
      bonds,
      stocks,
      crypto
    });

    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        if (value.inflation) store.dispatch(new SetInflationGraph(value.inflation));
        if (value.cash) store.dispatch(new SetCashGraph(value.cash));
        if (value.bonds) store.dispatch(new SetBondsGraph(value.bonds));
        if (value.stocks) store.dispatch(new SetStocksGraph(value.stocks));
        if (value.crypto) store.dispatch(new SetCryptoGraph(value.crypto));
      });
  }

  addGraph() {
    this.dialog.open<AddOrEditGraphDialogComponent, AddOrEditGraphDialogData, AddOrEditGraphDialogData>(AddOrEditGraphDialogComponent)
      .afterClosed()
      .subscribe(data => {
        if (data)
          this.store.dispatch(new AddOrUpdateGraph(data.name, data.graph));
      });
  }

  editGraph(name: string, graph: Graph) {
    this.dialog.open<AddOrEditGraphDialogComponent, AddOrEditGraphDialogData, AddOrEditGraphDialogData>(
      AddOrEditGraphDialogComponent,
      { data: { name, graph } }
    )
      .afterClosed()
      .subscribe(data => {
        if (data) {
          this.store.dispatch(new AddOrUpdateGraph(name, data.graph)).subscribe(() => {
            if (data.name !== name)
              this.store.dispatch(new RenameGraph(name, data.name));
          });
        }
      });
  }

  deleteGraph(name: string) {
    this.store.dispatch(new DeleteGraph(name));
  }
}
