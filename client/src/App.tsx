import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './pages/Layout';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { SongLibraryPage } from './pages/SongLibrary/SongLibraryPage';
import { SongDetailPage } from './pages/SongLibrary/SongDetailPage';
import { LearnPage } from './pages/Learn/LearnPage';
import { TestPage } from './pages/Test/TestPage';
import { PerformancePage } from './pages/Performance/PerformancePage';
import { AuthPage } from './pages/Auth/AuthPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/library" element={<SongLibraryPage />} />
        <Route path="/songs/:id" element={<SongDetailPage />} />
        <Route path="/learn/:songId" element={<LearnPage />} />
        <Route path="/test/:songId" element={<TestPage />} />
        <Route path="/performance/:id" element={<PerformancePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
