const { http_request } = require('node:process');

async function web_search_tool(query) {
  try {
    const url = `https://zeroclaw.com/api/tool/web_search_tool`;
    const body = JSON.stringify({query});
    const headers = {
      'Content-Type': 'application/json',
    };

    const response = await http_request(url, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return { error: `HTTP error! status: ${response.status}` };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error during web search:', error);
    return { error: error.message };
  }
}

module.exports = { web_search_tool };