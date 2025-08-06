import type { DynamicWithdrawalScheme, Portfolio, UnrolledStage } from '~/state/clients/plans/stages.state.model';

export type GraphDelta = {
  inflation: number;
  cash: number;
  bonds: number;
  stocks: number;
  crypto: number;
};

const mapRecord = <T extends Record<any, any>, R = T[keyof T]>(
  record: T,
  projection: (pair: [keyof T, T[keyof T]]) => [keyof T, R]
): Record<keyof T, R> => Object.fromEntries(Object.entries(record).map(([k, v]) => projection([k, v]))) as any;

export const calculateCycle = (
  startYear: number,
  endYear: number,
  initialPortfolio: Portfolio,
  stages: UnrolledStage[],
  deltas: GraphDelta[],
) => {
  let portfolio = initialPortfolio;
  let yearlyWithdrawal: number | undefined;
  let totalInflation = 1;
  let year = 0;
  const data = [Object.values(portfolio).reduce((total, value) => total + value, 0)];

  for (const stage of stages) {
    const stageEndYear = Math.min(stage.endYear ?? endYear, endYear);

    for (; startYear + year < stageEndYear; ++year) {
      const yearlyIncome = Object.values(stage.incomeByPerson).reduce((total, value) => total + value, 0) * totalInflation;

      const startOfYearTotal = Object.values(portfolio).reduce((total, value) => total + value, 0);

      const withdrawalScheme = stage.withdrawal;
      if (withdrawalScheme.type === 'constant') {
        yearlyWithdrawal = withdrawalScheme.initialRate
          ? withdrawalScheme.initialRate * totalInflation
          : (startOfYearTotal * (withdrawalScheme.targetPercentage ?? 0) / 100);
      } else {
        yearlyWithdrawal = yearlyWithdrawal === undefined
          ? startOfYearTotal * withdrawalScheme.targetPercentage / 100
          : calculateWithdrawal(yearlyWithdrawal, startOfYearTotal, withdrawalScheme);

        const minWithdrawal = withdrawalScheme.minimumRate * totalInflation;
        if (yearlyWithdrawal < minWithdrawal)
          yearlyWithdrawal = minWithdrawal;
      }

      const monthlyAdjustment = (yearlyIncome - yearlyWithdrawal) / 12;

      for (let month = 0; month < 12; ++month) {
        const delta = deltas[year*12 + month];
        totalInflation = totalInflation * delta.inflation;
        const grownPortfolio = mapRecord(portfolio, ([asset, amount]) => [asset, amount * delta[asset]]);
        const monthTotal = Math.max(0, Object.values(grownPortfolio).reduce((total, value) => total + value, monthlyAdjustment));

        if ((year * 12 + month + 1) % stage.portfolioRedistributionFrequency === 0) {
          portfolio = mapRecord(stage.portfolioDistribution, ([asset, value]) => [asset, value * monthTotal]);
        } else {
          if (monthlyAdjustment <= grownPortfolio.cash) {
            portfolio = {
              ...grownPortfolio,
              cash: grownPortfolio.cash - monthlyAdjustment
            };
          } else if (monthlyAdjustment <= grownPortfolio.cash + grownPortfolio.bonds) {
            portfolio = {
              ...grownPortfolio,
              cash: 0,
              bonds: grownPortfolio.bonds - (monthlyAdjustment - grownPortfolio.cash),
            };
          } else if (monthlyAdjustment <= grownPortfolio.cash + grownPortfolio.bonds + grownPortfolio.stocks) {
            portfolio = {
              ...grownPortfolio,
              cash: 0,
              bonds: 0,
              stocks: grownPortfolio.stocks - (monthlyAdjustment - grownPortfolio.cash - grownPortfolio.bonds),
            };
          } else if (monthlyAdjustment <= grownPortfolio.cash + grownPortfolio.bonds + grownPortfolio.stocks + grownPortfolio.crypto) {
            portfolio = {
              cash: 0,
              bonds: 0,
              stocks: 0,
              crypto: grownPortfolio.crypto - (monthlyAdjustment - grownPortfolio.cash - grownPortfolio.bonds - grownPortfolio.stocks),
            };
          } else {
            portfolio = {
              cash: 0,
              bonds: 0,
              stocks: 0,
              crypto: 0
            };
          }
        }

        data.push(monthTotal);
      }
    }
  }

  return data;
};

const calculateWithdrawal = (lastWithdrawal: number, totalPortfolio: number, scheme: DynamicWithdrawalScheme) => {
  const adjustment = scheme.adjustmentPercentage / 100;
  const target = scheme.targetPercentage / 100;
  const threshold = scheme.thresholdPercentage / 100;
  const lowerThreshold = target / (1 + threshold);
  const upperThreshold = target * (1 + threshold);

  if (totalPortfolio <= lastWithdrawal) {
    return totalPortfolio;
  } else if (lastWithdrawal < totalPortfolio * lowerThreshold) {
    return Math.min(totalPortfolio * target, lastWithdrawal * (1 + adjustment));
  } else if (lastWithdrawal > totalPortfolio * upperThreshold) {
    return Math.max(totalPortfolio * target, lastWithdrawal / (1 + adjustment));
  }

  return lastWithdrawal;
};
