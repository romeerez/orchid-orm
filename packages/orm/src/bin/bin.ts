import { askOrchidORMConfig, initOrchidORM } from './init';

askOrchidORMConfig().then(initOrchidORM);
