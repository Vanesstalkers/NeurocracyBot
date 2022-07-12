// import { VERSION } from 'https://coffeescript.org/browser-compiler-modern/coffeescript.js';
// import fs from 'fs';
// import * as TelegramBot from "node-telegram-bot-api";
import _TelegramApi from "node-telegram-bot-api";
// const TelegramApi = _TelegramApi;
// const TelegramApi = new Proxy(_TelegramApi, {
//     construct(target, args) {
//         console.log('construct');
//         return new Proxy(new target(...args), {});
//       },
// });
// const TelegramBot = await import("node-telegram-bot-api");
import * as m from 'node:module';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// require.cache[require.resolve('node-telegram-bot-api')].exports = TelegramBot;
require.cache[require.resolve('node-telegram-bot-api')].exports = new Proxy(_TelegramApi, {
    construct(target, args) {
        console.log('construct');
        return new Proxy(new target(...args), {});
      },
});

const TelegramBot = new _TelegramApi();

console.log(m);
console.log(123, {TelegramBot});