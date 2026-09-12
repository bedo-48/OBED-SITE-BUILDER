import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Project } from '../types'
import { toast } from 'sonner'
import api, { API_BASE_URL } from '../lib/api'
import { ArrowBigDownDashIcon, EyeIcon, EyeOffIcon, FullscreenIcon, LaptopIcon, Loader2Icon, MessageSquareIcon, SaveIcon, SmartphoneIcon, TabletIcon, XIcon } from 'lucide-react'
import ProjectPreview, { type ProjectPreviewRef } from '../components/ProjectPreview'
import Sidebar from '../components/Sidebar'
import GenerationStatus from '../components/LoaderSteps'

const Projects = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(true)
  const [device, setDevice] = useState<'phone' | 'tablet' | 'desktop'>('desktop')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [streamingCode, setStreamingCode] = useState('')
  const [genStatus, setGenStatus] = useState('')

  const previewRef = useRef<ProjectPreviewRef>(null)
  const startedRef = useRef(false)

  const fetchProject = async (): Promise<Project | null> => {
    try {
      const { data } = await api.get(`/api/user/project/${projectId}`)
      if (data.project) {
        setProject(data.project)
        setIsGenerating(!data.project.current_code)
        return data.project
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error.message)
    } finally {
      setLoading(false)
    }
    return null
  }

  // Stream the initial generation, rendering the HTML live as it is produced
  const streamGeneration = async () => {
    setIsGenerating(true)
    setStreamingCode('')
    setGenStatus('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/project/${projectId}/generate`, {
        method: 'POST',
        credentials: 'include',
      })

      // Already generated / in progress elsewhere → just load the result
      if (!res.ok || !res.body) {
        await fetchProject()
        setIsGenerating(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let code = ''

      // <iframe srcDoc> reparse TOUT le document a chaque changement de la prop.
      // Faire setStreamingCode() a chaque token SSE declenchait donc des
      // centaines de reparse par seconde et faisait ramer l'onglet.
      // On accumule dans une variable locale et on ne pousse dans le state
      // qu'au maximum toutes les FLUSH_MS millisecondes.
      const FLUSH_MS = 150
      let lastFlush = 0
      const flush = () => {
        lastFlush = performance.now()
        setStreamingCode(code)
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const frames = buffer.split('\n\n')
        buffer = frames.pop() || ''

        for (const frame of frames) {
          const eventLine = frame.split('\n').find((l) => l.startsWith('event:'))
          const dataLine = frame.split('\n').find((l) => l.startsWith('data:'))
          if (!dataLine) continue
          const event = eventLine?.slice(6).trim()
          const payload = JSON.parse(dataLine.slice(5).trim())

          if (event === 'status') {
            setGenStatus(payload.message || '')
          } else if (event === 'chunk') {
            code += payload.delta
            if (performance.now() - lastFlush > FLUSH_MS) flush()
          } else if (event === 'done') {
            await fetchProject()
            setStreamingCode('')
            setIsGenerating(false)
          } else if (event === 'error') {
            toast.error(payload.message || 'Generation failed')
            setIsGenerating(false)
          }
        }
      }
    } catch (error: any) {
      toast.error(error?.message || 'Generation failed')
      setIsGenerating(false)
    }
  }

// download code (index.html)

  const saveProject = async () => {
    const code = previewRef.current?.getCode() || project?.current_code
    if (!code || !projectId) return
    try {
      setIsSaving(true)
      const { data } = await api.post(`/api/user/project/${projectId}/save`, { code })
      setProject((prev) => (prev ? { ...prev, current_code: data.project.current_code } : prev))
      toast.success('Project saved')
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error.message)
    } finally {
      setIsSaving(false)
    }
  }
  const downloadCode = () => {
    const code = previewRef.current?.getCode() || project?.current_code
    if (!code) return

    // URL.createObjectURL alloue un blob qui reste en memoire jusqu'a ce qu'on
    // appelle revokeObjectURL. L'ancienne version ne le revoquait jamais et
    // laissait aussi le <a> dans le DOM a chaque telechargement : deux fuites.
    const url = URL.createObjectURL(new Blob([code], { type: 'text/html' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'index.html'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const togglePublish = async () => {
    if (!projectId) return
    try {
      const { data } = await api.get(`/api/user/publish-toggle/${projectId}`)
      setProject((prev) => (prev ? { ...prev, isPublished: data.isPublished } : prev))
      toast.success(data.isPublished ? 'Project published' : 'Project unpublished')
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error.message)
    }
  }

  useEffect(() => {
    if (!projectId) return
    startedRef.current = false
    ;(async () => {
      const p = await fetchProject()
      // Brand-new project with no code yet → stream its generation live
      if (p && !p.current_code && !startedRef.current) {
        startedRef.current = true
        streamGeneration()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2Icon className="size-7 animate-spin text-violet-200" />
      </div>
    )
  }

  return project ? (
    <div className='flex flex-col h-screen w-full bg-gray-900 text-white'>
      {/* builder navbar */}
      <div className='flex max-sm:flex-col sm:items-center gap-4 px-4 py-2 no-scrollbar'>

        {/* LEFT */}
        <div className='flex items-center gap-2 sm:min-w-90 text-nowrap'>
          <img src="/favicon.svg" alt="logo" className="h-6 cursor-pointer" onClick={() => navigate('/')} />
        </div>
        <div className='max-w-64 sm:max-w-xs'>
          <p className='text-sm text-medium capitalize truncate'>{project.name}</p>
          <p className='text-xs text-gray-400 -mt-0.5'>Previewing last saved version</p>
        </div>
        <div className='sm:hidden flex flex-1 justify-end'>
          {isMenuOpen
            ? <XIcon onClick={() => setIsMenuOpen(false)} className='size-6 cursor-pointer' />
            : <MessageSquareIcon onClick={() => setIsMenuOpen(true)} className='size-6 cursor-pointer' />
          }
        </div>

        {/* MIDDLE */}
        <div className='hidden sm:flex gap-2 bg-gray-950 p-1.5 rounded-md'>
          <SmartphoneIcon onClick={() => setDevice('phone')} className={`size-6 p-1 rounded cursor-pointer ${device === 'phone' ? 'bg-gray-700' : ''}`} />
          <TabletIcon onClick={() => setDevice('tablet')} className={`size-6 p-1 rounded cursor-pointer ${device === 'tablet' ? 'bg-gray-700' : ''}`} />
          <LaptopIcon onClick={() => setDevice('desktop')} className={`size-6 p-1 rounded cursor-pointer ${device === 'desktop' ? 'bg-gray-700' : ''}`} />
        </div>

        {/* RIGHT */}
        <div className='flex items-center justify-end gap-3 flex-1 text-xs sm:text-sm'>
          <button onClick={saveProject} disabled={isSaving} className='max-sm:hidden bg-gray-800 hover:bg-gray-700 text-white px-3.5 py-1 flex items-center gap-2 rounded sm:rounded-sm transition-colors border border-gray-700'>
            {isSaving ? <Loader2Icon className='animate-spin' size={16} /> : <SaveIcon size={16} />} Save
          </button>
          <Link target='_blank' to={`/preview/${projectId}`} className='flex items-center gap-2 px-4 py-1 rounded sm:rounded-sm border border-gray-700 hover:border-gray-500 transition-colors'>
            <FullscreenIcon size={16} /> Preview
          </Link>
          <button onClick={downloadCode} className='bg-linear-to-br from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white px-3.5 py-1 flex items-center gap-2 rounded sm:rounded-sm transition-colors'>
            <ArrowBigDownDashIcon size={16} /> Download
          </button>
          <button onClick={togglePublish} className='bg-linear-to-br from-indigo-700 to-indigo-600 hover:from-indigo-600 hover:to-indigo-500 text-white px-3.5 py-1 flex items-center gap-2 rounded sm:rounded-sm transition-colors'>
            {project.isPublished ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
            {project.isPublished ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      <div className='flex-1 flex overflow-auto'>
        <Sidebar isMenuOpen={isMenuOpen} project={project} setProject={setProject} isGenerating={isGenerating} setIsGenerating={setIsGenerating} />
        <div className='flex-1 p-2 pl-0'>
          {isGenerating && !streamingCode ? (
            <GenerationStatus status={genStatus} chars={streamingCode.length} />
          ) : (
          <ProjectPreview
            ref={previewRef}
            project={(isGenerating && streamingCode ? { ...project, current_code: streamingCode } : project) as Project}
            isGenerating={isGenerating}
            device={device}
            showEditorPanel={!isGenerating}
          />
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className='flex items-center justify-center h-screen'>
      <p className="text-2xl font-medium text-gray-200">Unable to load project</p>
    </div>
  )
}

export default Projects
