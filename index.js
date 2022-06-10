"use strict";

import config from "./config.js";
import pg from "pg";

import Lobby from "./src/Lobby.class.js";
import WebServer from "./web/Server.class.js";

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
  await WebServer.build();
  if (false) {
    const user = await LOBBY.getUser({
      fake: true,
      userId: 666,
      chatId: 777,
      //msg: { from: { id: 666 }, chat: { id: 777 } },
    });
    await BOT.toggleHandler({
      handler: "callback_query",
      msg: {
        data: "newRateEvent",
        from: { id: 666 },
        message: { chat: { id: 777 } },
      },
    });
    // await BOT.toggleHandler({
    //   handler: "callback_query",
    //   msg: {
    //     data: "claim",
    //     from: { id: 666 },
    //     message: { message_id: user.lastMsg.id, chat: { id: 777 } },
    //   },
    // });
    // await BOT.toggleHandler({
    //   handler: "callback_query",
    //   msg: {
    //     data: "claimAccept",
    //     from: { id: 666 },
    //     message: { message_id: user.lastMsg.confirmMsgId, chat: { id: 777 } },
    //   },
    // });
    // await BOT.toggleHandler({
    //   handler: "callback_query",
    //   msg: {
    //     data: "claimCancel",
    //     from: { id: 666 },
    //     message: { message_id: user.lastMsg.confirmMsgId, chat: { id: 777 } },
    //   },
    // });

    // await BOT.toggleHandler({
    //   handler: "callback_query",
    //   msg: {
    //     data: ['setQuestionRate', 0].join("__"),
    //     from: { id: 666 },
    //     message: { message_id: user.lastMsg.id, chat: { id: 777 } },
    //   },
    // });

    // for (const skill of Object.values(user.currentAction.skillList)) {
    //   await BOT.toggleHandler({
    //     handler: "callback_query",
    //     msg: {
    //       data: [
    //         "setSkillRate",
    //         skill.code,
    //         '+',
    //       ].join("__"),
    //       from: { id: 666 },
    //       message: { message_id: user.lastMsg.id, chat: { id: 777 } },
    //     },
    //   });
    // }

    // await BOT.toggleHandler({
    //   handler: "callback_query",
    //   msg: {
    //     data: 'save',
    //     from: { id: 666 },
    //     message: {
    //       message_id: user.lastMsg.id,
    //       from: { id: 666 },
    //       chat: { id: 777 },
    //     },
    //   },
    // });
  }
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
