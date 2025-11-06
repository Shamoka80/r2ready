
import fetch from 'node-fetch';

async function enableNeonEndpoint() {
  const NEON_API_KEY = 'G7v$eL9@qT2#xW8!mZ3^rB6&uK1*oN5%aJ';
  const PROJECT_ID = 'patient-butterfly-70500192';
  
  try {
    console.log('🔍 Fetching project endpoints...');
    
    // Get project endpoints
    const endpointsResponse = await fetch(
      `https://console.neon.tech/api/v2/projects/${PROJECT_ID}/endpoints`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${NEON_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!endpointsResponse.ok) {
      throw new Error(`Failed to fetch endpoints: ${endpointsResponse.status} ${endpointsResponse.statusText}`);
    }

    const endpointsData = await endpointsResponse.json();
    console.log('📋 Found endpoints:', endpointsData.endpoints.length);

    // Find the endpoint that matches our DATABASE_URL
    const targetEndpoint = endpointsData.endpoints.find(ep => 
      ep.host.includes('ep-old-snow-a8h8atvf')
    );

    if (!targetEndpoint) {
      console.error('❌ Could not find matching endpoint');
      return;
    }

    console.log(`🎯 Found target endpoint: ${targetEndpoint.id}`);
    console.log(`📊 Current state: ${targetEndpoint.current_state}`);

    if (targetEndpoint.current_state === 'active') {
      console.log('✅ Endpoint is already active!');
      return;
    }

    // Enable the endpoint
    console.log('🚀 Enabling endpoint...');
    const enableResponse = await fetch(
      `https://console.neon.tech/api/v2/projects/${PROJECT_ID}/endpoints/${targetEndpoint.id}/start`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NEON_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!enableResponse.ok) {
      throw new Error(`Failed to enable endpoint: ${enableResponse.status} ${enableResponse.statusText}`);
    }

    const enableData = await enableResponse.json();
    console.log('✅ Endpoint enabled successfully!');
    console.log(`📊 New state: ${enableData.endpoint.current_state}`);
    
    // Wait a moment for the endpoint to fully activate
    console.log('⏳ Waiting 5 seconds for endpoint to fully activate...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🎉 Endpoint should now be ready for connections!');

  } catch (error) {
    console.error('❌ Error enabling endpoint:', error.message);
    
    if (error.message.includes('401')) {
      console.error('🔑 API key may be invalid or expired');
    } else if (error.message.includes('404')) {
      console.error('🔍 Project or endpoint not found');
    }
    
    process.exit(1);
  }
}

enableNeonEndpoint();
