'use client'

import { createContext, useContext, useState } from 'react'

type Cart = { count: number; add: () => void }

const CartContext = createContext<Cart>({ count: 0, add: () => {} })

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0)
  return <CartContext.Provider value={{ count, add: () => setCount((c) => c + 1) }}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
