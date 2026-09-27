import { configureStore } from '@reduxjs/toolkit'
import aiReducer from './aiSlice'
import deviationReducer from './deviationSlice'

export const store = configureStore({
  reducer: {
    ai: aiReducer,
    deviation: deviationReducer,
  },
})
