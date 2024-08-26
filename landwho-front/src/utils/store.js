// src/utils/store.js
import { configureStore, createSlice } from '@reduxjs/toolkit';
import { useSelector, useDispatch } from 'react-redux';

const walletSlice = createSlice({
  name: 'wallet',
  initialState: typeof window !== 'undefined' ? localStorage.getItem('wallet') : null,
  reducers: {
    setWallet: (state, action) => {
      const wallet = action.payload;
      localStorage.setItem('wallet', wallet);
      return wallet;
    },
    clearWallet: () => {
      localStorage.removeItem('wallet');
      return null;
    },
  },
});

export const { setWallet, clearWallet } = walletSlice.actions;

const store = configureStore({
  reducer: {
    wallet: walletSlice.reducer,
  },
});

export const useWallet = () => useSelector((state) => state.wallet);
export const useWalletDispatch = () => useDispatch();

export default store;
