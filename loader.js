// https-loader.mjs
import { get } from 'node:https';
import { readFile as readFileAsync } from 'fs/promises';

export function resolve(specifier, context, defaultResolve) {
  const { parentURL = null } = context;

  // Normally Node.js would error on specifiers starting with 'https://', so
  // this hook intercepts them and converts them into absolute URLs to be
  // passed along to the later hooks below.
//   if (specifier.startsWith('https://')) {
//     return {
//       url: specifier
//     };
//   } else if (parentURL && parentURL.startsWith('https://')) {
//     return {
//       url: new URL(specifier, parentURL).href
//     };
//   }

  console.log({specifier, context});

  // Let Node.js handle all other specifiers.
  return defaultResolve(specifier, context, defaultResolve);
}

export function load(url, context, defaultLoad) {
  // For JavaScript to be loaded over the network, we need to fetch and
  // return it.
//   if (url.startsWith('https://')) {
//     return new Promise((resolve, reject) => {
//       get(url, (res) => {
//         let data = '';
//         res.on('data', (chunk) => data += chunk);
//         res.on('end', () => resolve({
//           // This example assumes all network-provided JavaScript is ES module
//           // code.
//           format: 'module',
//           source: data,
//         }));
//       }).on('error', (err) => reject(err));
//     });
//   }
  const parsed = new URL(url);
  console.log({url, context, parsed});
//   if (parsed.protocol === 'file:') {
//     return new Promise(async (resolve, reject) => {
//         const result = {
//             format: 'module',
//             source: await readFileAsync(parsed),
//         };
//         console.log('custom', result.source.toString());
//         resolve(result);
//     });
//   }else{
    // Let Node.js handle all other URLs.
    const defResult = defaultLoad(url, context, defaultLoad);
    console.log({defResult});
    return defResult;

    // return defaultLoad(url, context, defaultLoad);
//   }
}