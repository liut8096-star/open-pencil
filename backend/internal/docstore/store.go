package docstore

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"time"
)

var ErrDocumentNotFound = errors.New("document not found")

type DocumentMeta struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	Size      int64     `json:"size"`
}

type Store struct {
	root string
}

func New(root string) *Store {
	return &Store{root: root}
}

func (s *Store) Ensure() error {
	return os.MkdirAll(s.documentsDir(), 0o755)
}

func (s *Store) CreateDocument(name string) (*DocumentMeta, error) {
	if name == "" {
		name = "Untitled"
	}
	id, err := randomID()
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	meta := &DocumentMeta{
		ID:        id,
		Name:      name,
		CreatedAt: now,
		UpdatedAt: now,
		Size:      0,
	}
	if err := os.MkdirAll(s.documentDir(id), 0o755); err != nil {
		return nil, err
	}
	if err := s.writeMeta(meta); err != nil {
		return nil, err
	}
	return meta, nil
}

func (s *Store) GetDocument(id string) (*DocumentMeta, error) {
	metaPath := s.metaPath(id)
	data, err := os.ReadFile(metaPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrDocumentNotFound
	}
	if err != nil {
		return nil, err
	}
	var meta DocumentMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, err
	}
	return &meta, nil
}

func (s *Store) ReadContent(id string) ([]byte, *DocumentMeta, error) {
	meta, err := s.GetDocument(id)
	if err != nil {
		return nil, nil, err
	}
	data, err := os.ReadFile(s.contentPath(id))
	if errors.Is(err, os.ErrNotExist) {
		return nil, meta, nil
	}
	if err != nil {
		return nil, nil, err
	}
	return data, meta, nil
}

func (s *Store) WriteContent(id string, name string, data []byte) (*DocumentMeta, error) {
	meta, err := s.GetDocument(id)
	if err != nil {
		return nil, err
	}
	if name != "" {
		meta.Name = name
	}
	meta.UpdatedAt = time.Now().UTC()
	meta.Size = int64(len(data))

	if err := os.MkdirAll(s.documentDir(id), 0o755); err != nil {
		return nil, err
	}
	if err := writeFileAtomic(s.contentPath(id), data, 0o644); err != nil {
		return nil, err
	}
	if err := s.writeMeta(meta); err != nil {
		return nil, err
	}
	return meta, nil
}

func (s *Store) documentsDir() string {
	return filepath.Join(s.root, "documents")
}

func (s *Store) documentDir(id string) string {
	return filepath.Join(s.documentsDir(), id)
}

func (s *Store) metaPath(id string) string {
	return filepath.Join(s.documentDir(id), "meta.json")
}

func (s *Store) contentPath(id string) string {
	return filepath.Join(s.documentDir(id), "current.fig")
}

func (s *Store) writeMeta(meta *DocumentMeta) error {
	payload, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(s.metaPath(meta.ID), payload, 0o644)
}

func writeFileAtomic(path string, data []byte, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, mode); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}

func randomID() (string, error) {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
