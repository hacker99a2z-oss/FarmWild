/* eslint-disable */
// @ts-nocheck

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as MarketRouteImport } from './routes/market'
import { Route as ReferRouteImport } from './routes/refer'
import { Route as WithdrawRouteImport } from './routes/withdraw'

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)

const MarketRoute = MarketRouteImport.update({
  id: '/market',
  path: '/market',
  getParentRoute: () => rootRouteImport,
} as any)

const ReferRoute = ReferRouteImport.update({
  id: '/refer',
  path: '/refer',
  getParentRoute: () => rootRouteImport,
} as any)

const WithdrawRoute = WithdrawRouteImport.update({
  id: '/withdraw',
  path: '/withdraw',
  getParentRoute: () => rootRouteImport,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/market': typeof MarketRoute
  '/refer': typeof ReferRoute
  '/withdraw': typeof WithdrawRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/market': typeof MarketRoute
  '/refer': typeof ReferRoute
  '/withdraw': typeof WithdrawRoute
}

export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/market': typeof MarketRoute
  '/refer': typeof ReferRoute
  '/withdraw': typeof WithdrawRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/market' | '/refer' | '/withdraw'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/market' | '/refer' | '/withdraw'
  id: '__root__' | '/' | '/market' | '/refer' | '/withdraw'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  MarketRoute: typeof MarketRoute
  ReferRoute: typeof ReferRoute
  WithdrawRoute: typeof WithdrawRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/market': {
      id: '/market'
      path: '/market'
      fullPath: '/market'
      preLoaderRoute: typeof MarketRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/refer': {
      id: '/refer'
      path: '/refer'
      fullPath: '/refer'
      preLoaderRoute: typeof ReferRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/withdraw': {
      id: '/withdraw'
      path: '/withdraw'
      fullPath: '/withdraw'
      preLoaderRoute: typeof WithdrawRouteImport
      parentRoute: typeof rootRouteImport
    }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  MarketRoute: MarketRoute,
  ReferRoute: ReferRoute,
  WithdrawRoute: WithdrawRoute,
}

export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()
