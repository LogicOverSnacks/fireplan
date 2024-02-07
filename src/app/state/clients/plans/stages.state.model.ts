export type Portfolio = {
  cash: number;
  bonds: number;
  stocks: number;
  crypto: number;
};

export type ConstantWithdrawalScheme = {
  type: 'constant';

  initialRate?: number;
  targetPercentage?: number;
};

/** Modified Guyton Klinger */
export type DynamicWithdrawalScheme = {
  type: 'dynamic';

  /** max. amount the withdrawal rate can be adjusted */
  adjustmentPercentage: number;

  /** The percentage of the portfolio that are we aiming for the withdrawal rate to be */
  targetPercentage: number;

  /** threshold for adjusting the withdrawal rate (i.e. the guardrails) */
  thresholdPercentage: number;

  /** once per year (how often to check for & do these adjustments) range from 0.2 to 12 (once every 5 years to once per month) */
  // frequency: number;
};

// export type CashRefillWithdrawalScheme = {
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

export type WithdrawalScheme = ConstantWithdrawalScheme | DynamicWithdrawalScheme;

export type Stage = {
  id: string;
  name: string;
  deletable: boolean;

  /** undefined means that this stage never ends */
  endYear?: number;

  /**
   * person id -> net income
   * undefined means use the same amount as the previous stage.
  */
  incomeByPerson?: Record<string, number>;

  /** undefined means use the same scheme as the previous stage. */
  withdrawal?: WithdrawalScheme;

  /**
   * undefined means use the same as the previous stage.
   * In what proportions the portfolio is distributed, all values must sum to 1.
   */
  portfolioDistribution?: Portfolio;

  /** 1 means every month, 3 means once every quarter, 12 means once per year, etc. */
  portfolioRedistributionFrequency?: number;
};

export type UnrolledStage = {
  id: string;
  name: string;
  deletable: boolean;

  endYear?: number;

  /** person id -> gross income */
  incomeByPerson: Record<string, number>;

  withdrawal: WithdrawalScheme;

  /**
   * in what proportions the portfolio is distributed. All values (excluding frequency) must sum to 1.
   */
  portfolioDistribution: Portfolio;

  portfolioRedistributionFrequency: number;
};
