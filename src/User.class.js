import { startMenuMsg } from "./BotQueryHelper.js";

export default class User {
  id;
  constructor() {}
  async init({ userId, userData = {}, telegramData = {} } = {}) {
    const queryData = await process.DB.query(
      `
                SELECT u.id, u.data
                FROM users u
                WHERE u.id = $1
                GROUP BY u.id
            `,
      [userId]
    );
    const user = queryData.rows[0] || {};
    if (!user.id) {
      const queryResult = await process.DB.query(
        `
                    INSERT INTO users (id, data, telegram, last_login)
                    VALUES ($1, $2, $3, NOW()::timestamp)
                    RETURNING id
                `,
        [userId, userData, telegramData]
      );
      this.id = queryResult.rows[0].id;
      user.data = userData;
    } else {
      this.id = user.id;
      await process.DB.query(
        `
                    UPDATE users
                    SET telegram = $1, last_login = NOW()::timestamp
                    WHERE id = $2
                `,
        [telegramData, userId]
      );
    }
    return this;
  }
  async startMsg({ msg } = {}) {
    await process.BOT.sendMessage(
      startMenuMsg.call(this, {
        text: `Привет, друг!`,
        inlineKeyboard: [[
            { text: 'И тебе привет', callback_data: 'hello' },
        ]],
      })
    );
  }
}
