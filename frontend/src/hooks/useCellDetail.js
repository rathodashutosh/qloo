import { useState, useCallback } from 'react';
import { fetchCellDetail } from '../api/client';

/**
 * Hook to fetch and manage cell detail data.
 */
export default function useCellDetail(conceptId) {
  const [cellData, setCellData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadCell = useCallback(async (cellId) => {
    if (!cellId || !conceptId) {
      setCellData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchCellDetail(cellId, conceptId);
      setCellData(data);
    } catch (err) {
      setError(err.message || 'Failed to load cell detail');
      setCellData(null);
    } finally {
      setLoading(false);
    }
  }, [conceptId]);

  const clear = useCallback(() => {
    setCellData(null);
    setError(null);
  }, []);

  return { cellData, loading, error, loadCell, clear };
}
