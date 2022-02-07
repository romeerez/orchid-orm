export const pgConfig = {
  host: process.env.POSTGRES_HOST as string,
  port: Number(process.env.POSTGRES_POST as string),
  database: process.env.POSTGRES_DATABASE as string,
  user: process.env.POSTGRES_USER as string,
  password: process.env.POSTGRES_PASSWORD as string,
};
