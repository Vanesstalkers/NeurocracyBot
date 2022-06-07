import emojiLST from "./lst/emoji.js";

export default {};

export function numberToEmoji(num) {
  let numToConvert = num;
  if (typeof numToConvert !== "string") numToConvert = numToConvert.toString();
  const arr = numToConvert.split("");
  return arr.map((n) => emojiLST[n] || n).join("");
}
