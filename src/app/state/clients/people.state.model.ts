import { Moment, default as moment } from 'moment';

export type Person = {
  id: string;
  name: string;
  dateOfBirth: Moment;
  lifeExpectancy: {
    mean: number; // 81.4
    variance: number; // 8
  };

  // TODO: option for not qualifying for the full state pension
};

export type SerializedPerson = Omit<Person, 'dateOfBirth'> & { dateOfBirth: string; };

export const serializePerson = (person: Person): SerializedPerson => ({
  ...person,
  dateOfBirth: person.dateOfBirth.toISOString()
});

export const deserializePerson = (person: SerializedPerson): Person => ({
  ...person,
  dateOfBirth: moment(person.dateOfBirth)
});
