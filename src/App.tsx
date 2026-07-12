import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import FeedDirectory from "./pages/FeedDirectory";
import FeedDetail from "./pages/FeedDetail";
import SearchResults from "./pages/SearchResults";
import Recap from "./pages/Recap";
import ReadingStream from "./pages/ReadingStream";
import EntryDetail from "./pages/EntryDetail";
import Bookmarks from "./pages/Bookmarks";
import Archive from "./pages/Archive";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <ErrorBoundary>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/feeds" element={<FeedDirectory />} />
          <Route path="/feed/:id" element={<FeedDetail />} />
          <Route path="/reading" element={<ReadingStream />} />
          <Route path="/entry/:feedId/:entryId" element={<EntryDetail />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/recap" element={<Recap />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
