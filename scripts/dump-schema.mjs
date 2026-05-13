import https from 'https';

const url = 'https://rxcsiwlvumzeezkxioeg.supabase.co/rest/v1/products?select=*&limit=1';

const options = {
  headers: {
    'apikey': 'sb_publishable_CyArHp1GHDFx74qBXcuPzQ_3HfBjPXv',
    'Authorization': 'Bearer sb_publishable_CyArHp1GHDFx74qBXcuPzQ_3HfBjPXv'
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
      if (parsed && parsed.length > 0) {
        console.log("--- INFERRED SCHEMA FROM FIRST ROW ---");
        const row = parsed[0];
        const schema = {};
        for (const [k, v] of Object.entries(row)) {
          schema[k] = typeof v;
          if (Array.isArray(v)) schema[k] = 'array';
          if (v === null) schema[k] = 'null (unknown)';
        }
        console.log(JSON.stringify(schema, null, 2));
      }
    } catch (e) {
      console.error("Failed to parse JSON", e);
    }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
