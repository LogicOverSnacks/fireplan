import { promises as fs } from 'node:fs';


const file = await fs.readFile('./LBMA-GOLD.csv');
const lines = file.toString().split('\n');


const data = lines
  .map(line => line.split(',').slice(0, 2))
  .map(([date, price]) => ({ date, price: +price }));


let lastPrice = null;
let year = 0;
let month = 0;
const results = [];
for (const { date, price } of data.reverse()) {
  const [y, m, d] = date.split('-');

  if (lastPrice === null) {
    year = y;
    month = m;
    lastPrice = price;
    continue;
  }

  if (y !== year || m !== month) {
    results.push({
      date,
      price,
      rate: 100 * price / lastPrice - 100
    });
    year = y;
    month = m;
    lastPrice = price;
  }
}

await fs.writeFile('./ggg.json', JSON.stringify(results, undefined, 2));
