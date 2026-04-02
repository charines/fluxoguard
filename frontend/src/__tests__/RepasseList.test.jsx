import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RepasseList from '../RepasseList';
import * as api from '../api';

// Mock the API module
vi.mock('../api', () => ({
  getTransactions: vi.fn(),
  getUsersByType: vi.fn(),
}));

// Mock localStorage
const mockUser = {
  tipo: 'ADMIN',
  nome: 'Admin Teste'
};

describe('RepasseList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('fluxoguard_admin_user', JSON.stringify(mockUser));
    api.getUsersByType.mockResolvedValue([]); // Default mock
  });

  it('renders progress text while loading', () => {
    api.getTransactions.mockReturnValue(new Promise(() => {})); // Never resolves
    render(<RepasseList />);
    expect(screen.getByText(/Carregando repasses.../i)).toBeInTheDocument();
  });

  it('renders "Historico de Repasses" header after loading', async () => {
    api.getTransactions.mockResolvedValue([]);
    api.getUsersByType.mockResolvedValue([]);
    
    render(<RepasseList />);
    
    await waitFor(() => {
      expect(screen.getByText(/Histórico de Repasses/i)).toBeInTheDocument();
    });
  });

  it('shows error message if API fails', async () => {
    api.getTransactions.mockRejectedValue({
      response: { data: { detail: 'Erro de teste' } }
    });
    
    render(<RepasseList />);
    
    await waitFor(() => {
      expect(screen.getByText(/Erro de teste/i)).toBeInTheDocument();
    });
  });
});
