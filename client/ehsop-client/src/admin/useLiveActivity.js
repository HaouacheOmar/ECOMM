import { useEffect } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { api } from '../api.js'
import { socketRefresher } from '../auth/authApi.js'
import { connectSocket } from '../socket.js'

// The Admin's live staff view: presence and Employee Session events refetch the Employees list and
// the activity log (as does every reconnection).
export default function useLiveActivity() {
  const dispatch = useDispatch()
  const store = useStore()
  const userId = useSelector((state) => state.auth.user?.id)

  useEffect(() => {
    if (!userId) return
    const refetch = () => dispatch(api.util.invalidateTags(['Employee', 'EmployeeSession']))
    return connectSocket('/ws/activity/', {
      getToken: () => store.getState().auth.accessToken,
      refresh: socketRefresher(dispatch),
      onReady: refetch,
      onEvent: refetch,
    }).close
  }, [userId, dispatch, store])
}
