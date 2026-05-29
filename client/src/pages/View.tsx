import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import api from '../lib/api'
import ProjectPreview from '../components/ProjectPreview'
import type { Project } from '../types'

const View = () => {

    const { projectId } = useParams()
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(true)

    const fetchCode = async () => {
        try {
            const { data } = await api.get(`/api/project/published/${projectId}`)
            setCode(data.project?.current_code || '')
        } catch (error: any) {
            toast.error(error?.response?.data?.message || error.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCode()
    }, [projectId])

    if (loading) {
        return (
            <div className='flex items-center justify-center h-screen'>
                <Loader2Icon className='size-7 animate-spin text-indigo-200' />
            </div>
        )
    }

    return (
        <div className='h-screen'>
            {code ? (
                <ProjectPreview
                    project={{ current_code: code } as Project}
                    isGenerating={false}
                    showEditorPanel={false}
                />
            ) : (
                <div className="flex items-center justify-center h-screen text-gray-300">
                    <p>This project is not available</p>
                </div>
            )}
        </div>
    )
}

export default View
