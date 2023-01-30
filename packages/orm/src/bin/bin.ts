#!/usr/bin/env node
import { astOrchidORMConfig, initOrchidORM } from './init';

astOrchidORMConfig().then(initOrchidORM);
