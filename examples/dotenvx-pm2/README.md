This is an example of using [dotenvx](https://dotenvx.com/) with pm2.

It demonstrates how to update the environment for forked and clustered apps using dotenvx.

In this example, the environment variables come from three sources and are applied in the following order (dotenv files take precedence because of the `--overload` option used):
- shell environment
- dotenv files `.env.initial` or `.env.updated`.
- pm2 ecosystem config `ecosystem.config.cjs`

See `package.json` scripts for the actual commands.

```bash
# install dotenvx
npm install
# start apps with `initial` environment and `.env.initial` dotenv file
npm run start:json
# reload apps with `updated` environment and `.env.updated` dotenv file
npm run reload:json
# delete apps
npm run delete:json
```
