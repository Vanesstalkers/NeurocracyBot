export default {
  process(sourceText, sourcePath, options) {
    if (sourceText.includes(`import { jest } from "@jest/globals";`))
      return { code: sourceText };
    const importList = Array.from(sourceText.matchAll(/import(.*)from(.*);/gm));
    const mockImportList = [];
    console.log({ t: this });
    //console.log({jest});
    for (const item of importList) {
      let importItem = `// ${item[0]}`;
      const hash = 'test_'+item[2].replaceAll(/[^A-Za-z]/gm, '')
      importItem += `\nconst ${hash} = new Proxy(await import(${item[2]}), jest[${item[2]}].handlers);`;
      item[1]
        .trim()
        .split(",")
        .forEach((param) => {
          if (param.trim()[0] === "{") {
            importItem += `\nconst ${param} = ${hash} || {};`;
          } else {
            importItem += `\nconst ${param} = ${hash}.default || null;`;
          }
        });
        importItem = `try{${importItem}}catch(err){console.log(err)}`;
      mockImportList.push(importItem);
    }
    const lastItem = importList[importList.length - 1];
    if (!lastItem) {
      return { code: sourceText };
    } else {
      return {
        code:
          'import { jest } from "@jest/globals";\n' +
          mockImportList.join("\n") +
          sourceText.substr(lastItem.index + lastItem[0].length),
      };
    }
  },
};
