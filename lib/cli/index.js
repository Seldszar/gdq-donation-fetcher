#!/usr/bin/env node

const commander = require("commander");
const main = require("..");

async function run() {
  const program = new commander.Command();

  program.option("--base <url>", "the base url", String, "https://gamesdonequick.com/tracker/");
  program.option("--donor <pattern>", "the donor pattern", String, "*");
  program.arguments("<event>");

  program.parse(process.argv);

  if (program.args[0] === undefined) {
    program.help();
  }

  main({
    baseUrl: program.base,
    eventName: program.args[0],
    donorPattern: program.donor,
  });
}

if (module === require.main) {
  run();
}
