import { askOrchidORMConfig, initOrchidORM } from './init';

askOrchidORMConfig().then((config) => {
  if (config) initOrchidORM(config);
});
