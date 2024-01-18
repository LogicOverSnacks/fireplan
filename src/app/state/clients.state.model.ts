import { Moment } from 'moment';

import { Asset } from './clients/assets.state.model';
import { Person } from './clients/people.state.model';
import { Plan } from './clients/plans.state.model';

export type Currency = 'EUR' | 'GBP' | 'USD';

export type Client = {
  archived: boolean;
  name: string;
  lastFetch: Moment | null;
  currency: Currency;

  people: Person[];

  plans: Record<string, Plan>;
  selectedPlanId: string | null;

  assets: Asset[];
}

export type ClientsStateModel = {
  clients: Record<number, Client>;
  maxClientId: number;
  selectedClientId: number | null;
}
