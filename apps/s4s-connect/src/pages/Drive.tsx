import React, { useState } from 'react'
import { trpc } from '../trpc'
import { useAuthStore } from '../store/auth'
import ClassDriveConfigModal from '../components/ClassDriveConfigModal'
import { LoadingSpinner, EmptyState, Button, Modal, Input } from '@s4s/ui'
import '../styles/drive.css'

export default function Drive() {
  const user = useAuthStore((s) => s.user)
  const utils = trpc.useUtils()

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([])

  // Modal States
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [editingClassData, setEditingClassData] = useState<any>(null)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  // Form States
  const [newFolderName, setNewFolderName] = useState('')
  const [newFileName, setNewFileName] = useState('')
  const [newFileType, setNewFileType] = useState('application/pdf')
  const [newFileSize, setNewFileSize] = useState(1024)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [availableAt, setAvailableAt] = useState<string>('')
  const [isModalDraggingOver, setIsModalDraggingOver] = useState(false)

  // Queries
  const { data: classes = [], isLoading: loadingClasses } = trpc.drive.listClasses.useQuery()
  const { data: contents, isLoading: loadingContents } = trpc.drive.getClassContents.useQuery(
    { classId: selectedClassId || '' },
    { enabled: Boolean(selectedClassId) }
  )

  // Mutations
  const createFolderMutation = trpc.drive.createFolder.useMutation({
    onSuccess: () => {
      utils.drive.getClassContents.invalidate({ classId: selectedClassId || '' })
      setShowNewFolderModal(false)
      setNewFolderName('')
    },
  })

  const deleteFolderMutation = trpc.drive.deleteFolder.useMutation({
    onSuccess: () => {
      utils.drive.getClassContents.invalidate({ classId: selectedClassId || '' })
    },
  })

  const createFileMutation = trpc.drive.createFile.useMutation({
    onSuccess: () => {
      utils.drive.getClassContents.invalidate({ classId: selectedClassId || '' })
      setShowUploadModal(false)
      setNewFileName('')
    },
  })

  const deleteFileMutation = trpc.drive.deleteFile.useMutation({
    onSuccess: () => {
      utils.drive.getClassContents.invalidate({ classId: selectedClassId || '' })
    },
  })


  const handleFolderClick = (folder: any) => {
    setCurrentFolderId(folder.id)
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }])
  }

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentFolderId(null)
      setFolderPath([])
    } else {
      setCurrentFolderId(folderPath[index].id)
      setFolderPath(folderPath.slice(0, index + 1))
    }
  }

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim() || !selectedClassId) return
    createFolderMutation.mutate({
      name: newFolderName.trim(),
      classId: selectedClassId,
      parentId: currentFolderId,
    })
  }

  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (contents?.canWrite) {
      setIsDraggingOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }

  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null)

  const handleFileSelection = (file: File) => {
    setSelectedFile(file)
    setNewFileName(file.name)
    setNewFileType(file.type || 'application/octet-stream')
    setNewFileSize(file.size)

    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        setFileDataUrl(event.target.result as string)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)

    if (!contents?.canWrite || !selectedClassId) return

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0])
      setAvailableAt('')
      setShowUploadModal(true)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0])
    }
  }

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFileName.trim() || !selectedClassId) return
    createFileMutation.mutate({
      name: newFileName.trim(),
      mimeType: newFileType,
      size: Number(newFileSize),
      classId: selectedClassId,
      folderId: currentFolderId,
      content: fileDataUrl || undefined,
      availableAt: availableAt ? new Date(availableAt).toISOString() : null,
    })
  }

  const handleDeleteFolder = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`Supprimer le dossier "${name}" ?`)) {
      deleteFolderMutation.mutate({ id, classId: selectedClassId || '' })
    }
  }

  const handleDeleteFile = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`Supprimer le fichier "${name}" ?`)) {
      deleteFileMutation.mutate({ id, classId: selectedClassId || '' })
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  // Auto-select first class when classes are loaded
  React.useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id)
    }
  }, [classes, selectedClassId])

  const handleClassSelect = (classId: string) => {
    setSelectedClassId(classId)
    setCurrentFolderId(null)
    setFolderPath([])
    setIsMobileSidebarOpen(false)
  }

  // Filter current folder contents
  const currentFolders = contents?.folders.filter(f => f.parentId === currentFolderId) || []
  const currentFiles = contents?.files.filter(f => f.folderId === currentFolderId) || []
  const isEmpty = currentFolders.length === 0 && currentFiles.length === 0

  const activeClass = classes.find(c => c.id === selectedClassId)

  return (
    <div className="drive-container">
      {/* Mobile Top Selector Bar */}
      <div className="mobile-class-selector-bar">
        <button
          className="mobile-class-btn"
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        >
          <span>📂</span>
          <span>{activeClass ? activeClass.name : 'Choisir une classe'}</span>
          <span style={{ fontSize: '0.7rem', marginLeft: 'auto' }}>{isMobileSidebarOpen ? '▲' : '▼'}</span>
        </button>
        {user?.role === 'ADMIN' && (
          <button
            className="action-btn-mini"
            style={{ background: 'rgba(115, 118, 196, 0.15)', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.85rem' }}
            onClick={() => {
              setEditingClassData(null)
              setShowConfigModal(true)
            }}
          >
            + Classe
          </button>
        )}
      </div>

      {/* Sidebar: Class List */}
      <aside className={`drive-sidebar ${isMobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="sidebar-title">
            📂 Drive & Cours
          </h2>
          {isMobileSidebarOpen && (
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
            >
              ✕
            </button>
          )}
        </div>
        {user?.role === 'ADMIN' && (
          <button
            className="create-class-btn"
            onClick={() => {
              setEditingClassData(null)
              setShowConfigModal(true)
              setIsMobileSidebarOpen(false)
            }}
          >
            + Créer une classe
          </button>
        )}

        {loadingClasses ? (
          <LoadingSpinner label="Chargement des classes..." />
        ) : classes.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#64748b', textAlign: 'center', margin: '2rem 0' }}>
            Aucune classe disponible.
          </p>
        ) : (
          <div className="classes-list">
            {classes.map((cls) => (
              <button
                key={cls.id}
                className={`class-item-btn ${selectedClassId === cls.id ? 'active' : ''}`}
                onClick={() => handleClassSelect(cls.id)}
              >
                <span className="class-name">{cls.name}</span>
                {user?.role === 'ADMIN' && (
                  <div className="class-actions">
                    <button
                      className="action-btn-mini"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingClassData(cls)
                        setShowConfigModal(true)
                      }}
                      title="Configurer"
                    >
                      ⚙️
                    </button>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main
        className={`drive-content ${isDraggingOver ? 'dragging-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ position: 'relative' }}
      >
        {isDraggingOver && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 900,
              backgroundColor: 'rgba(65, 51, 95, 0.85)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '4px dashed #ff66b3',
              borderRadius: '16px',
              margin: '1rem',
              color: '#ffffff',
              pointerEvents: 'none',
              animation: 's4s-fade-in 150ms ease-out',
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📥</div>
            <h2 style={{ color: '#ffffff', fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
              Déposez votre fichier ici
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1rem', marginTop: '0.5rem' }}>
              Importez directement dans {folderPath.length > 0 ? folderPath[folderPath.length - 1].name : activeClass?.name}
            </p>
          </div>
        )}

        {!selectedClassId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
            <EmptyState
              icon="📂"
              title="Sélectionnez une classe"
              description="Sélectionnez une classe dans le menu de gauche pour accéder à ses documents et fichiers partagés."
            />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="drive-content-header">
              <div className="header-left">
                <h1 className="header-class-name">{activeClass?.name}</h1>
                <div className="header-class-meta">
                  {activeClass?.Section && activeClass.Section.length > 0 && (
                    <span>Sections: {activeClass.Section.map((s: any) => s.name).join(', ')}</span>
                  )}
                  {contents?.canWrite && (
                    <>
                      {activeClass?.Section && activeClass.Section.length > 0 && <span>•</span>}
                      <span className="drive-badge rw">Accès R/W</span>
                    </>
                  )}
                </div>
              </div>
              <div className="header-actions">
                {contents?.canWrite && (
                  <>
                    <button className="btn-new-folder" onClick={() => setShowNewFolderModal(true)}>
                      📁 Nouveau dossier
                    </button>
                    <button className="btn-upload" onClick={() => setShowUploadModal(true)}>
                      📤 Ajouter un fichier
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Breadcrumb Navigation */}
            <div className="breadcrumb">
              <span className="breadcrumb-item" onClick={() => handleBreadcrumbClick(-1)}>
                {activeClass?.name}
              </span>
              {folderPath.map((folder, index) => (
                <React.Fragment key={folder.id}>
                  <span className="breadcrumb-separator">/</span>
                  <span
                    className={index === folderPath.length - 1 ? 'breadcrumb-active' : 'breadcrumb-item'}
                    onClick={() => handleBreadcrumbClick(index)}
                  >
                    {folder.name}
                  </span>
                </React.Fragment>
              ))}
            </div>

            {/* Drive Items Grid */}
            {loadingContents ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingSpinner label="Chargement des fichiers..." />
              </div>
            ) : isEmpty ? (
              <div className="no-items-state">
                <span className="no-items-icon">☁️</span>
                <h3 className="no-items-title">Ce dossier est vide</h3>
                <p className="no-items-desc">
                  {contents?.canWrite
                    ? 'Commencez à organiser votre Drive en créant des dossiers ou en important des fichiers.'
                    : "Aucun fichier n'a été publié dans ce dossier pour le moment."}
                </p>
              </div>
            ) : (
              <div className="drive-items-grid">
                {/* Folders */}
                {currentFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="drive-card folder"
                    onClick={() => handleFolderClick(folder)}
                  >
                    <div className="card-icon-wrapper">📁</div>
                    <h4 className="card-title">{folder.name}</h4>
                    <div className="card-meta">
                      <span>Dossier</span>
                    </div>
                    {contents?.canWrite && (
                      <button
                        className="card-delete-btn"
                        onClick={(e) => handleDeleteFolder(folder.id, folder.name, e)}
                        title="Supprimer le dossier"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}

                {/* Files */}
                {currentFiles.map((file) => {
                  const isScheduledFuture = file.availableAt && new Date(file.availableAt) > new Date()
                  return (
                    <div
                      key={file.id}
                      className="drive-card file"
                      onClick={() => {
                        if (file.key && file.key.startsWith('/uploads/')) {
                          window.open(`https://s4s-connect.students4students.ch/api${file.key}`, '_blank')
                        } else if (file.key && file.key.startsWith('data:')) {
                          const win = window.open()
                          if (win) {
                            win.document.write(`<iframe src="${file.key}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`)
                            win.document.title = file.name
                          }
                        } else {
                          window.open(`https://s4s-connect.students4students.ch/api/uploads/${file.key}`, '_blank')
                        }
                      }}
                    >
                      <div className="card-icon-wrapper">
                        {isScheduledFuture ? '⏰' : '📄'}
                      </div>
                      <h4 className="card-title">{file.name}</h4>
                      <div className="card-meta">
                        <span>{formatSize(file.size)}</span>
                        <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                      </div>
                      {isScheduledFuture && contents?.canWrite && (
                        <div style={{ marginTop: '0.25rem' }}>
                          <span className="drive-badge ro" style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            ⏳ Dispo: {new Date(file.availableAt!).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                      {contents?.canWrite && (
                        <button
                          className="card-delete-btn"
                          onClick={(e) => handleDeleteFile(file.id, file.name, e)}
                          title="Supprimer le fichier"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Class Create/Edit Config Modal */}
      {showConfigModal && (
        <ClassDriveConfigModal
          initialData={editingClassData}
          onClose={() => setShowConfigModal(false)}
        />
      )}

      {/* Create Folder Modal */}
      {showNewFolderModal && (
        <Modal isOpen onClose={() => setShowNewFolderModal(false)} title="Créer un nouveau dossier" size="sm">
          <form onSubmit={handleCreateFolder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input
              label="Nom du dossier"
              required
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Ex: Séries d'exercices"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="button" variant="secondary" onClick={() => setShowNewFolderModal(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" isLoading={createFolderMutation.isPending}>
                Créer
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Upload/Add File Modal */}
      {showUploadModal && (
        <Modal isOpen onClose={() => setShowUploadModal(false)} title="Importer un fichier" size="md">
          <form onSubmit={handleCreateFile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="s4s-form-field">
              <label className="s4s-label">Fichier à importer *</label>
              <div
                style={{
                  border: isModalDraggingOver ? '2px dashed #ff66b3' : '2px dashed rgba(238, 212, 241, 0.4)',
                  borderRadius: '12px',
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  background: isModalDraggingOver ? 'rgba(255, 102, 179, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  transform: isModalDraggingOver ? 'scale(1.02)' : 'none',
                }}
                onClick={() => document.getElementById('file-upload-input')?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsModalDraggingOver(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsModalDraggingOver(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsModalDraggingOver(false)
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelection(e.dataTransfer.files[0])
                  }
                }}
              >
                <input
                  id="file-upload-input"
                  type="file"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                  {isModalDraggingOver ? '📥' : '📄'}
                </div>
                {selectedFile ? (
                  <div>
                    <strong style={{ color: '#ffffff', fontSize: '1rem' }}>{selectedFile.name}</strong>
                    <div style={{ fontSize: '0.825rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: '0.25rem' }}>
                      {formatSize(selectedFile.size)} • {selectedFile.type || 'Fichier'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <strong style={{ color: '#ffffff', fontSize: '1rem' }}>
                      {isModalDraggingOver ? 'Glissez votre fichier ici' : 'Glissez-déposez un fichier ici'}
                    </strong>
                    <div style={{ fontSize: '0.825rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.35rem' }}>
                      ou cliquez pour parcourir vos dossiers
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Input
              label="Nom d'affichage du fichier"
              required
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Ex: Série 1 - Solutions.pdf"
            />

            <div className="s4s-form-field">
              <label className="s4s-label">Rendre disponible à partir du (Optionnel)</label>
              <input
                type="datetime-local"
                className="s4s-input"
                value={availableAt}
                onChange={(e) => setAvailableAt(e.target.value)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border: '1px solid rgba(238, 212, 241, 0.2)',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>
                Laissez vide pour publier immédiatement. Si une date est définie, les étudiants ne verront ce fichier qu'à partir de cette date/heure.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="secondary" onClick={() => setShowUploadModal(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" isLoading={createFileMutation.isPending}>
                Importer le fichier
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
