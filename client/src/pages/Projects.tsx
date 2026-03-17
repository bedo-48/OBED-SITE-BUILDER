import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Project } from '../types'
import { dummyConversations, dummyProjects, dummyVersions } from '../assets/assets'
import { ArrowBigDownDashIcon, EyeIcon, EyeOffIcon, FullscreenIcon, LaptopIcon, Loader2Icon, MessageSquareIcon, SaveIcon, SmartphoneIcon, TabletIcon, XIcon } from 'lucide-react'
import ProjectPreview, { type ProjectPreviewRef } from '../components/ProjectPreview'
import Sidebar from '../components/Sidebar'

const Projects = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(true)
  const [device, setDevice] = useState<'phone' | 'tablet' | 'desktop'>('desktop')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const previewRef = useRef<ProjectPreviewRef>(null)

  const fetchProject = async () => {
    console.log('projectId from URL:', projectId)
    console.log('available IDs:', dummyProjects.map(p => p.id))
    console.log('projectId from URL:', projectId)
    console.log('typeof projectId:', typeof projectId)
    
    const project = dummyProjects.find(p => String(p.id) === String(projectId))
    console.log('found:', project)
    
    setTimeout(() => {
        if (project) {
            setProject({ ...project, conversation: dummyConversations, versions: dummyVersions })
            setIsGenerating(project.current_code ? false : true)
        }
        setLoading(false)
    }, 2000)
}

  const saveProject = async () => {}
  const downloadCode = () => {}
  const togglePublish = async () => {}

  useEffect(() => {
    fetchProject()
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
        <Sidebar isMenuOpen={isMenuOpen} project={project} setProject={(p) => setProject(p)} isGenerating={isGenerating} setIsGenerating={setIsGenerating} />
        <div className='flex-1 p-2 pl-0'>
          <ProjectPreview ref={previewRef} project={project} isGenerating={isGenerating} device={device} />
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