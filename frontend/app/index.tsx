import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface PhotoEntry {
  id: string;
  text: string;
  date: string;
  base64: string;
}

const STORAGE_KEY = 'photo_entries';

export default function Index() {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const cameraRef = useRef<CameraView>(null);

  // Load saved photos on startup
  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPhotos(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading photos:', error);
    }
  };

  const savePhotos = async (newPhotos: PhotoEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPhotos));
    } catch (error) {
      console.error('Error saving photos:', error);
    }
  };

  const openCamera = async () => {
    // Request camera permission
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Brak uprawnień', 'Aplikacja potrzebuje dostępu do kamery');
        return;
      }
    }

    // Request media library permission
    if (!mediaPermission?.granted) {
      const result = await requestMediaPermission();
      if (!result.granted) {
        Alert.alert('Brak uprawnień', 'Aplikacja potrzebuje dostępu do galerii');
        return;
      }
    }

    setCameraVisible(true);
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.7,
        });

        if (photo && photo.base64) {
          // Format date and time
          const now = new Date();
          const dateString = now.toLocaleDateString('pl-PL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          const timeString = now.toLocaleTimeString('pl-PL', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          const newEntry: PhotoEntry = {
            id: Date.now().toString(),
            text: text || '',
            date: `${dateString} ${timeString}`,
            base64: photo.base64,
          };

          const updatedPhotos = [newEntry, ...photos];
          setPhotos(updatedPhotos);
          await savePhotos(updatedPhotos);

          // Save to gallery
          try {
            await MediaLibrary.saveToLibraryAsync(photo.uri);
          } catch (e) {
            console.log('Could not save to gallery');
          }

          setCameraVisible(false);
          setText('');
          Alert.alert('Sukces!', 'Zdjęcie zostało zapisane');
        }
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Błąd', 'Nie udało się zrobić zdjęcia');
      }
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const deletePhoto = (id: string) => {
    Alert.alert(
      'Usuń zdjęcie',
      'Czy na pewno chcesz usunąć to zdjęcie?',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            const updatedPhotos = photos.filter(p => p.id !== id);
            setPhotos(updatedPhotos);
            await savePhotos(updatedPhotos);
          },
        },
      ]
    );
  };

  const renderPhotoItem = ({ item }: { item: PhotoEntry }) => (
    <View style={styles.photoCard}>
      <Image
        source={{ uri: `data:image/jpeg;base64,${item.base64}` }}
        style={styles.photoImage}
        resizeMode="cover"
      />
      <View style={styles.photoInfo}>
        <Text style={styles.photoText} numberOfLines={2}>
          {item.text || '(brak tekstu)'}
        </Text>
        <Text style={styles.photoDate}>{item.date}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deletePhoto(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color="#ff4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Aparat z Notatką</Text>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.textInput}
            placeholder="Wpisz tekst do zdjęcia..."
            placeholderTextColor="#888"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={200}
          />
          <TouchableOpacity style={styles.cameraButton} onPress={openCamera}>
            <Ionicons name="camera" size={32} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Photos List */}
        <View style={styles.listContainer}>
          {photos.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={64} color="#444" />
              <Text style={styles.emptyText}>Brak zdjęć</Text>
              <Text style={styles.emptySubtext}>
                Wpisz tekst i naciśnij ikonę aparatu
              </Text>
            </View>
          ) : (
            <FlatList
              data={photos}
              renderItem={renderPhotoItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Camera Modal */}
      <Modal visible={cameraVisible} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
          >
            <SafeAreaView style={styles.cameraOverlay}>
              {/* Top bar with text preview */}
              <View style={styles.cameraTopBar}>
                <View style={styles.textPreview}>
                  <Text style={styles.textPreviewLabel}>Tekst:</Text>
                  <Text style={styles.textPreviewContent} numberOfLines={1}>
                    {text || '(brak)'}
                  </Text>
                </View>
              </View>

              {/* Bottom controls */}
              <View style={styles.cameraControls}>
                <TouchableOpacity
                  style={styles.cameraControlButton}
                  onPress={() => setCameraVisible(false)}
                >
                  <Ionicons name="close" size={30} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={takePhoto}
                >
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cameraControlButton}
                  onPress={toggleCameraFacing}
                >
                  <Ionicons name="camera-reverse" size={30} color="#fff" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </CameraView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  inputSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    minHeight: 56,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#333',
  },
  cameraButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    color: '#666',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#444',
    marginTop: 8,
    textAlign: 'center',
  },
  photoCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  photoImage: {
    width: 80,
    height: 80,
  },
  photoInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  photoText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    marginBottom: 4,
  },
  photoDate: {
    fontSize: 12,
    color: '#888',
  },
  deleteButton: {
    padding: 12,
    justifyContent: 'center',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraTopBar: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  textPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textPreviewLabel: {
    color: '#888',
    fontSize: 14,
    marginRight: 8,
  },
  textPreviewContent: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cameraControlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
});
