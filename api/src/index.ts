// Server entry: loads config, builds the app, starts listening.
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);

createApp().listen(port, () => {
  console.log(`API listening on :${port}`);
});
