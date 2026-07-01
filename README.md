A Node.js script that generates the configuration needed for RCO (Readcomiconline) extension to work.

## Getting Started
Clone the repository:
   ```bash
   git clone https://github.com/JakeeLuwi/rco-decrypt.git
   ```

Install dependencies:
   ```bash
   npm install
   ```

#### Testing and Building
   Generate the configuration:
   ```bash
   npm run gen
   ```

   Test the image parsing logic (look below for `sampleScriptText.js` and `pages.json`)
   ```bash
   npm run test
   ```
*Testing for post decryption is not implemented yet as there is currently no need for that feature.*

## Configuration

The script can be configured with these environment variables (configure in `.env`):

```ini
# .env.sample
shouldVerify=false
shouldObfuscate=false
fileName="output.json"
```

For more advanced configuration, see `builder.js` params. 

## Script Structure

**rcoDecrypt.js**
Handles page list parsing. Must "return":
```js
JSON.stringify(parsedPageArray)
```

**rcoPostDecrypt.js** (optional)
Processes the page list array. Must also "return":
```js
JSON.stringify(parsedPageArray)
```

**sampleScriptText.js**  
A real page capture from RCO used to test `rcoDecrypt.js`.

**pages.json**  
Maps page numbers to their expected image path, used to verify the decoded output. Add as few or as many pages as you like, copy an image address from the browser and paste it in (any query string is ignored):
```json
{
  "pages": [
        {
            "page": "1",
            "path": ""
        }
    ]
}
```
**Make sure page links are of the same image quality and server to** `sampleScriptText.js`