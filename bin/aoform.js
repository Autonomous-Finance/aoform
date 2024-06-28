#!/usr/bin/env node

import { program } from 'commander';
import { applyCommand } from '../src/commands/apply.js';
import { initCommand } from '../src/commands/init.js';

program
  .name('aoform')
  .description('A tool for managing AO processes')
  .version('0.0.1');

program
  .command('apply')
  .description('Deploy or update processes')
  .option('-f, --file <path>', 'Specify a custom processes.yaml file')
  .action(applyCommand);

program
  .command('init')
  .description('Initialize a new processes.yaml file')
  .action(initCommand);

program.parse(process.argv);