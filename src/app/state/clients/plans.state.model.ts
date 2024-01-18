export type Stage = {
  id: string;
  name: string;
  deletable: boolean;

  /** undefined means that this stage never ends */
  endYear?: number;

  people?: Record<string, {
    /** undefined means use the same amount as the previous stage. */
    grossIncome?: number;
  }>;

  /** How much money you spend each year. */
  costs?: {
    essential?: number;
    flexible?: number;
  };

  /**
   * undefined means use the same amount as the previous stage.
   * Value should be entered as the amount after tax, but not inflation adjusted.
   */
  contributionsPerYear?: number;

  // /**
  //  * undefined means use the same as the previous stage.
  //  * in what proportions the portfolio is distributed. All values (excluding frequency) must sum to 1.
  //  */
  portfolioDistribution?: {
    cash: number;
    bonds: number;
    stocks: number;
    crypto: number;

    /** how often is the portfolio readjusted, e.g. a value of 2 means adjust once every 2 years */
    frequency: number;
  };
}

export type GuytonKlingerScheme = {
  type: 'guyton-klinger';
  initialPercentage: number; // 4% (how much of the initial portfolio to use as the starting withdrawal rate)
  guardRails: { // thresholds for adjusting the withdrawal rate
    lower: number; // -20% = 4.8%
    upper: number; // +20% = 3.2%
  };
  adjustmentPercentage: number; // 5% (how much to adjust the withdrawal rate)
  frequency: number; // once per year (how often to check for & do these adjustments)
}

// export type CashRefillScheme = {
//   type: 'cash-refill';
//   initialPercentage: number; // 4% (how much of the initial portfolio to use as the starting withdrawal rate)
//   targetBuffer: number; // 5 years (how many years of withdrawals to keep as a cash buffer)
//   thresholds: { // performance of assets under which conversion to cash is prevented
//     bonds: number; // 0%
//     stocks: number; // 2% (i.e. if stocks gained less than 2% this year don't sell any unless there is no other way)
//     crypto: number;
//   };
//   frequency: number; // how often to refill the cash pot - default: once per year
// }

export type Scheme = GuytonKlingerScheme;

export type FullPlan = {
  inheritsFrom: null;
  name: string;
  stages: Stage[];
  scheme: Scheme;
}

export type PartialPlan = {
  inheritsFrom: string;
  name: string;
  scheme?: Scheme;
  stages?: Stage[];
};

export type Plan = FullPlan | PartialPlan;
