export default function TestSetup() {
  return (
    <div className="min-h-screen relative">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Test Setup Route
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            This is a test route to verify routing is working.
          </p>
          
          <div className="glass-morphism p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Route Test Results</h2>
            <ul className="space-y-2">
              <li>✅ Route accessible at /test-setup</li>
              <li>✅ Component rendering correctly</li>
              <li>✅ No import/export issues</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}