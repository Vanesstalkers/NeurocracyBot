import { BuildableClass } from "../src/Base.class.js";
import skillLST from "../src/lst/skill.js";

import path from "path";
import express from "express";

export default class WebServer extends BuildableClass {
  constructor() {
    super(...arguments);
  }
  static async build() {
    const app = express();
    app.use(express.json());

    app.get("/", (req, res) => {
      res.cookie("user_id", req.query.user_id);
      res.cookie("action", req.query.action);
      res.sendFile(path.resolve("web/index.html"));
    });

    app.get("/user/*/info", async (req, res) => {
      const userId = req.params[0];
      const user = await LOBBY.getUser({ userId, chatId: userId });
      res.json(user);
    });
    app.get("/user/*/alert", async (req, res) => {
      const userId = req.params[0];
      const user = await LOBBY.getUser({ userId, chatId: userId });
      const alertList = await user.getAlertList();
      res.json(alertList);
    });
    app.get("/lst/*", (req, res) => {
      let lst = {};
      switch (req.params[0]) {
        case "skills":
          lst = skillLST || {};
      }
      res.json(lst);
    });
    app.post("/update_user/*", async (req, res) => {
      const userId = req.params[0];
      const user = await LOBBY.getUser({ userId, chatId: userId });
      if (
        await user
          .updateSkillList({ skillList: req.body, needConfigSkillsValue: 0 })
          .catch((err) => {
            res.json({ status: "err", msg: err.message });
          })
      ) {
        res.json({ status: "ok" });
      }
    });

    const port = 8000;
    app.listen(port, () => {
      console.log(`App listening on port ${port}`);
    });
  }
}
