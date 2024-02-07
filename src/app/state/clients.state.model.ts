import { mapRecord } from '~/core';
import { Asset } from './clients/assets.state.model';
import { Person, SerializedPerson, deserializePerson, serializePerson } from './clients/people.state.model';
import { Plan } from './clients/plans.state.model';

export type Currency = 'EUR' | 'GBP' | 'USD';

export type Client = {
  archived: boolean;
  name: string;
  currency: Currency;

  people: Person[];

  plans: Record<string, Plan>;
  selectedPlanId: string | null;

  assets: Asset[];
};

export type ClientsStateModel = {
  clients: Record<number, Client>;
  maxClientId: number;
  selectedClientId: number | null;
};

export type SerializedClient = Omit<Client, 'people'> & { people: SerializedPerson[] };
export type SerializedClientsStateModel = Omit<ClientsStateModel, 'clients'> & { clients: Record<number, SerializedClient>; };

export const serializeClient = (client: Client): SerializedClient => ({
  ...client,
  people: client.people.map(serializePerson)
});

export const serializeClientsState = (state: ClientsStateModel): SerializedClientsStateModel => ({
  ...state,
  clients: mapRecord(state.clients, ([id, client]) => [id, serializeClient(client)])
});

export const deserializeClient = (client: SerializedClient): Client => ({
  ...client,
  people: client.people.map(deserializePerson)
});

export const deserializeClientsState = (state: SerializedClientsStateModel): ClientsStateModel => ({
  ...state,
  clients: mapRecord(state.clients, ([id, client]) => [id, deserializeClient(client)])
});
