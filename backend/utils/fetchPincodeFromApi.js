const https = require('https');

async function fetchPincodeFromApi(pincode) {
  const url = `https://api.postalpincode.in/pincode/${pincode}`;

  const data = await new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });

  if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
    const first = data[0].PostOffice[0];
    return {
      success: true,
      town: first.Name,
      district: first.District,
      state: first.State,
      region: first.Division || first.Region || first.District,
    };
  }

  return { success: false };
}

module.exports = { fetchPincodeFromApi };
