import emojiLST from "./lst/emoji.js";
import skillLST from "./lst/skill.js";

export default {};

export function numberToEmoji(num) {
  let numToConvert = num;
  if (typeof numToConvert !== "string") numToConvert = numToConvert.toString();
  const arr = numToConvert.split("");
  return arr.map((n) => emojiLST[n] || n).join("");
}

export function getRewardArray({ rewardList }) {
  const rewardArray = [];
  for (const [skillCode, skillUpdateValue] of Object.entries(rewardList)) {
    if (skillUpdateValue > 0 || skillUpdateValue < 0) {
      const skillUpdatePrefix = skillUpdateValue > 0 ? "+" : "";
      rewardArray.push(
        emojiLST[skillUpdatePrefix || "-"] +
          skillLST[skillCode].label +
          ` (<b>${skillUpdatePrefix}${skillUpdateValue}</b>)`
      );
    }
  }
  return rewardArray;
}
