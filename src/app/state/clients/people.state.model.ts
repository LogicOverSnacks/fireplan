export type Person = {
  id: string;
  name: string;
  dateOfBirth: Date;
  lifeExpectancy: {
    mean: number; // 81.4
    variance: number; // 8
  };

  // TODO: option for not qualifying for the full state pension
}
