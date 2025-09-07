import React, { useState } from 'react';

// Simple test component to verify React hooks are working
function TestComponent() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">Q</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">QLD Parcel GIS Explorer</h1>
              <p className="text-sm text-muted-foreground">
                Resolve parcels and intersect with spatial layers
              </p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        <TestComponent />
        <p className="mt-4 text-muted-foreground">
          React hooks are working! The full application will be restored once the hook issue is resolved.
        </p>
      </main>
    </div>
  );
}

export default App