"use strict";

import config from "./config.js";
import pg from "pg";

import Lobby from "./src/Lobby.class.js";

console.error = (...arg) =>
  console.log(
    ["\x1b[31m"]
      .concat(...arg)
      .concat(["\x1b[30m"])
      .join(" ")
  );
globalThis.errorCatcher = class {
  constructor(err, knownError) {
    console.error(err?.message);
    if (!knownError) console.log(err);
  }
};

try {
  globalThis.CONFIG = config;
  globalThis.DB = new pg.Pool(CONFIG.postgres);
  globalThis.LOBBY = await Lobby.build();
} catch (err) {
  switch (err.message) {
    default:
      new errorCatcher(err);
      break;
  }
}

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled Rejection at:", promise, "reason:", reason);
});
