import chalk from "chalk";
export const log = {
  info: (m: string) => console.log(chalk.cyan("[i]"), m),
  ok:   (m: string) => console.log(chalk.green("[✓]"), m),
  warn: (m: string) => console.log(chalk.yellow("[!]"), m),
  err:  (m: string) => console.error(chalk.red("[x]"), m),
};