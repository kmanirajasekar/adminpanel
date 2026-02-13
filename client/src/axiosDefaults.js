import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:5000'
})

// Always read the latest token so route guards work right after login/logout.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')

  if (!config.headers) {
    config.headers = {}
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else {
    delete config.headers.Authorization
  }

  return config
})

export default api
