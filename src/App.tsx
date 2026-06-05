import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import FeedDirectory from "./pages/FeedDirectory";
import FeedDetail from "./pages/FeedDetail";

function App() {
  return (
    <ErrorBoundary>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/feeds" element={<FeedDirectory />} />
          <Route path="/feed/:id" element={<FeedDetail />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
