import { useEffect } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { api } from '../api.js'
import { socketRefresher } from '../auth/authApi.js'
import { connectSocket } from '../socket.js'

// Keeps every Order list and page current: staff get all Orders, a Customer their own. Any event,
// and every reconnection (which may have missed some), refetches the cached Order queries.
export default function useLiveOrders() {
  const dispatch = useDispatch()
  const store = useStore()
  const userId = useSelector((state) => state.auth.user?.id)

  useEffect(() => {
    if (!userId) return
    const refetch = () => dispatch(api.util.invalidateTags(['Order']))
    return connectSocket('/ws/orders/', {
      getToken: () => store.getState().auth.accessToken,
      refresh: socketRefresher(dispatch),
      onReady: refetch,
      onEvent: refetch,
    }).close
  }, [userId, dispatch, store])
}
